param(
    [Parameter(Mandatory=$true)][string]$RequestsFile,
    [Parameter(Mandatory=$true)][string]$ReceiptFile
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$requests = @(Get-Content -Raw -Encoding UTF8 -LiteralPath $RequestsFile | ConvertFrom-Json)
if ($requests.Count -lt 1 -or $requests.Count -gt 4) {
    throw 'Submit one to four known IDEALS handles per batch.'
}
$ids = @{}
foreach ($request in $requests) {
    if ($request.record_id -cnotmatch '^[0-9a-f]{8}$' -or $request.handle -cnotmatch '^2142/[0-9]+$') {
        throw 'Each request requires a vault record ID and an exact 2142/NNNNN handle.'
    }
    if ($ids.ContainsKey($request.handle)) { throw 'Duplicate handle in this batch.' }
    $ids[$request.handle] = $true
}

$queueChecks = @'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('\u68c0\u7d22\u961f\u5217.sqlite', { readOnly: true });
const now = new Date().toISOString();
const blocked = db.prepare("SELECT value AS until FROM settings WHERE key IN ('backoff_until','thesis_search_retry_after') AND value > ? UNION ALL SELECT until FROM host_limits WHERE host IN ('ideals.illinois.edu','www.ideals.illinois.edu') AND until > ?").all(now, now);
const pages = db.prepare("SELECT record_id,url,state,retrieved,attempts FROM pages WHERE url LIKE 'https://www.ideals.illinois.edu/oai-pmh?%'").all();
const leases = db.prepare("SELECT p.url FROM page_leases l JOIN pages p ON p.id=l.page_id WHERE l.expires_at > ? AND p.url LIKE 'https://www.ideals.illinois.edu/oai-pmh?%'").all(now);
console.log(JSON.stringify({ blocked, pages, leases, records: db.prepare('SELECT id FROM records').all() }));
'@
$queueJson = $queueChecks | node --no-warnings -
if ($LASTEXITCODE -ne 0) { throw 'Could not verify live queue limits.' }
$queue = $queueJson | ConvertFrom-Json
if ($queue.blocked.Count -gt 0) { throw "IDEALS queue paused until $($queue.blocked.until -join ', ')" }
foreach ($request in $requests) {
    if ($queue.records.id -notcontains $request.record_id) { throw "Unknown record $($request.record_id)." }
}

if (Test-Path -LiteralPath $ReceiptFile) { throw 'Receipt already exists. Ingest it before requesting another batch.' }
$receipts = [Collections.Generic.List[object]]::new()
$metadata = [Collections.Generic.List[object]]::new()
foreach ($request in $requests) {
    $identifier = [Uri]::EscapeDataString("oai:www.ideals.illinois.edu:$($request.handle)")
    $url = "https://www.ideals.illinois.edu/oai-pmh?verb=GetRecord&metadataPrefix=native&identifier=$identifier"
    $prior = $queue.pages | Where-Object { $_.record_id -eq $request.record_id -and $_.url -eq $url }
    if ($queue.leases.url -contains $url -or $prior.state -in @('done','excluded') -or $prior.attempts -ge 3) { continue }
    if ($prior.retrieved -and [DateTimeOffset]::Parse($prior.retrieved) -gt [DateTimeOffset]::UtcNow.AddMinutes(-30)) { continue }
    if ($receipts.Count -gt 0) { Start-Sleep -Seconds 2 }

    $ErrorActionPreference = 'Continue'
    try {
        $reply = @(curl.exe --max-time 20 --silent --show-error --write-out '\n%{http_code}' --url $url 2>&1)
        $curlExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = 'Stop'
    }
    $status = [string]$reply[-1]
    $receipt = [ordered]@{ record_id = $request.record_id; url = $url }
    if ($curlExit -ne 0 -or $status -ne '200') {
        $receipt.error = "IDEALS original metadata request failed. HTTP $status, curl exit $curlExit."
        if ($status -eq '429') { $receipt.error = "Failed to fetch " + $url + ': (429) Too Many Requests' }
        $receipts.Add($receipt)
        break
    }
    try {
        [xml]$xml = $reply[0..($reply.Count - 2)] -join [Environment]::NewLine
        $matchingId = $xml.SelectSingleNode("//*[local-name()='record']/*[local-name()='header']/*[local-name()='identifier']")
        $fields = $xml.SelectNodes("//*[local-name()='metadata']//*[local-name()='field']")
        if ($matchingId.InnerText -ne [Uri]::UnescapeDataString($identifier) -or $fields.Count -eq 0) {
            throw 'No matching native metadata record returned.'
        }
        $selected = @($fields | Where-Object {
            $_.schema -eq 'thesis' -and $_.element -eq 'degree' -or
            $_.schema -eq 'dc' -and ($_.element -in @('creator','title','contributor') -or ($_.element -eq 'date' -and $_.qualifier -eq 'issued'))
        })
        $metadata.Add([ordered]@{
            record_id = $request.record_id
            handle = $request.handle
            author = @($selected | Where-Object { $_.element -eq 'creator' } | Select-Object -ExpandProperty InnerText)
            degree = @($selected | Where-Object { $_.element -eq 'degree' -and $_.qualifier -eq 'name' } | Select-Object -ExpandProperty InnerText)
            title = @($selected | Where-Object { $_.element -eq 'title' } | Select-Object -ExpandProperty InnerText)
            advisor = @($selected | Where-Object { $_.element -eq 'contributor' -and $_.qualifier -eq 'advisor' } | Select-Object -ExpandProperty InnerText)
            chair = @($selected | Where-Object { $_.element -eq 'contributor' -and $_.qualifier -eq 'committeeChair' } | Select-Object -ExpandProperty InnerText)
        })
        $receipt.raw = ($selected | Select-Object -ExpandProperty OuterXml) -join [Environment]::NewLine
        $receipt.excerpt = 'IDEALS original native fields. The author and degree must be matched to the target PI. Only qualifier=advisor identifies the recorded advisor.'
    } catch {
        [void]$receipt.Remove('raw')
        [void]$receipt.Remove('excerpt')
        $receipt.error = $_.Exception.Message
    }
    $receipts.Add($receipt)
}
if ($receipts.Count -gt 0) {
    $json = ConvertTo-Json -InputObject $receipts.ToArray() -Depth 5
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReceiptFile), $json + [Environment]::NewLine, $OutputEncoding)
}
ConvertTo-Json -InputObject $metadata.ToArray() -Depth 5 -Compress
