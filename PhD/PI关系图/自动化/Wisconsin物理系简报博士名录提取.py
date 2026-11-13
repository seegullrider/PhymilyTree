from contextlib import closing
from pathlib import Path
from pypdfium2 import PdfDocument
from collections import Counter
import argparse, json, re, sys, unicodedata

parser = argparse.ArgumentParser(description="Extract verified doctoral roster pages from UW–Madison Physics newsletters.")
parser.add_argument("pdf_dir",type=Path)
parser.add_argument("output",type=Path)
args=parser.parse_args()

base="https://www.physics.wisc.edu/newsletter/"
entries=[]
sources={}
def read(issue,pdf_name,page_number,bottom=None):
    sources[issue]=base+pdf_name
    with closing(PdfDocument(args.pdf_dir / f"{issue}.pdf")) as doc:
        with closing(doc[page_number-1]) as page, closing(page.get_textpage()) as tp:
            text=tp.get_text_bounded(top=bottom) if bottom else tp.get_text_bounded()
    return unicodedata.normalize("NFKC", text).replace("\x02","").replace("\u00ad","")

def add(issue,page,name,advisor,term=None):
    name=name.strip().strip(",")
    if "," in name:
        last,first=map(str.strip,name.split(",",1))
        name=f"{first} {last}"
    advisor=advisor.strip().replace('Sa"man','Saffman').replace('Sa!man','Saffman').replace('Sar"','Sarff').replace('#i!eault','Thiffeault')
    if not name or not advisor:
        raise ValueError((issue,page,name,advisor))
    entry={"name":name,"advisor_as_printed":advisor,"stage":"phd","issue":issue,"pdf_page":page,"source":sources[issue]+f"#page={page}"}
    if term is not None:
        entry["term"]=term
    entries.append(entry)

# Earlier issues print names, titles and parenthetical surnames with no Advisor heading.
early={
 ("2002","news02.pdf",11):{
  "August 2001":"Jay Anderson|Forest;Jason Breitweg|Smith;D. Matthew Feldmann|Larbalestier;Jing Jiang|Han;Nikolas Kauer|Zeppenfeld;Danny Marfatia|Han;Jason Nielsen|Wu;Steven Watchorn|Roesler",
  "December 2001":"Rostyslav Boutchko|Bruch;Young-Jae Kim|Han/Barger;Yadong Li|DeLuca/Zagzebski;Christopher O’Dell|Timbie;Katherine Rawlins|Karle;Brian Schwartz|Quin;Thomas Wright|Prepost",
  "May 2002":"Theodore Biewer|Prager/Forest;Eric Charles|Wu;Peter McNamara|Wu;Zoran Skoda|Chubukov"
 },
 ("2003","news03.pdf",13):{
  "August 2002":"Todd Coleman|Olsson;John Kelly IV|Lagally;Benjamin Wood|Barger",
  "December 2002":"John Frandy|Knutson;Rellen Hardtke|Halzen;Angela Laird|Meyerand;Chien-ye Tsau|Joynt",
  "May 2003":"Bien Chann|Walker;Daniel Hooper|Halzen;Armen Kirakosian|Himpsel"
 },
 ("2007","Phys_Nwsltr_Vol_14.pdf",10):{
  "August 2006":"Arthur Blair|Prager;Terrance M. Figy|Zeppenfeld;Jonathon Hollar|Prepost;Xianglin Ke|Rzchowski;Oo Kaw Lim|Saffman;John Wheeler Maiden|Shiu;Mark David Nornberg|Forest;Patrick Daniel Ryan|Smith;Keith Aaron Slinker|Eriksson;Emre Tepedelenlioglu|Ogelman;Pengpeng Zhang|Lagally",
  "December 2006":"Rachel Cannara|Eriksson/Carpick;Alexander Donkov|Chubukov;Benjamin Hudson|Prager;Paul Kutter|Wu;Delmar Marshall|Lin;Antonio Romano|Chung;Jason Simmons|Eriksson",
  "May 2007":"Shan-Huei Chuang|Carlsmith;Maria Teresa Herd|Lawler;Brennan Hughey|Karle;Pavle Juranic|Lawler"
 }
}
for (issue,pdf,page),terms in early.items():
    text=read(issue,pdf,page)
    for term,rows in terms.items():
        for row in rows.split(";"):
            name,advisor=row.split("|")
            if name not in text:
                simple=lambda s:re.sub(r"[^a-z0-9]","",s.lower())
                if simple(name) not in simple(text):
                    raise ValueError(f"Check early source name: {name}")
            add(issue,page,name,advisor,term)

# The 2012 page is set in three columns. The PDF text preserves complete entries after PhD Degrees.
issue,pdf,page="spring2012","newsletter-spring2012.pdf",10
text=read(issue,pdf,page)
doctorate=text.split("PhD Degrees",1)[1]
for match in re.finditer(r"^\s*([A-Z][^\n(]{2,60})\(Advisor:\s*([^\n)]*(?:\n[^\n)]*)?)\)",doctorate,re.M):
    name=match[1].strip()
    if name=="Dumm Jonathan Paul":
        name="Jonathan Paul Dumm"
    add(issue,page,name,re.sub(r"\s+"," ",match[2]))

# Remove masters by accepting only lines with Thesis, including an Advisor field wrapped to the next line.
for issue,pdf,pages in [
    ("fall2016","newsletter-2016_0.pdf",[20]),
    ("fall2017","newsletter-2017a.pdf",[22,23]),
]:
    for page in pages:
        text=read(issue,pdf,page)
        for m in re.finditer(r"^([\w .’'-]+, [\w .’'-]+)\s*\|\s*Advisor:\s*([^\n|]+)\s*\|\s*Thesis\s*:",text,re.M):
            add(issue,page,m[1],m[2])

# In the recent formats, each Advisor line belongs to the previous name in the doctoral section.
for issue,pdf,page in [
    ("2021","newsletter-2021.pdf",23),
    ("2022","newsletter-2022.pdf",24),
    ("2024","newsletter-2024.pdf",12),
]:
    text=read(issue,pdf,page)
    lines=[line.strip() for line in text.split("Doctoral Degrees",1)[1].splitlines() if line.strip()]
    for i,line in enumerate(lines[1:],1):
        match=re.fullmatch(r"Advisors?:\s*(.+)",line)
        if match:
            add(issue,page,lines[i-1].replace("Ja!e","Jaffe"),match[1])
    if issue=="2021":
        add(issue,page,"Sam Neyens","Eriksson","Spring 2020")

count=Counter(row["issue"] for row in entries)
expected={"2002":19,"2003":10,"2007":22,"spring2012":36,"fall2016":16,"fall2017":24,"2021":18,"2022":23,"2024":19}
if count!=expected:
    print(json.dumps(dict(count)),file=sys.stderr)
    raise SystemExit("Doctoral row counts differ from page inspection.")
result={"source":"https://www.physics.wisc.edu/magazine/","title":"The Wisconsin Physicist — doctoral degree rosters from nine issues","sources":sources,"issue_counts":dict(count),"entries":entries}
args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(dict(count)))
