from pathlib import Path
from Model import Model
from csv import DictReader
from sys import argv

##
# Add product categories to be displayed in main navigation
# Pass a CSV file with following fields: category, code, desc, subcategory
#
# py addCategory.py <path to CSV file>
##

DIR = Path(__file__).parent
ENV_PATH = DIR.parent / '..' / 'src' / '.env'

cols = ('category', 'code', 'desc', 'subcategory')
docs = []

file = Path(argv[1])

if not file.exists():
    exit('File does not exist')

reader = DictReader(file.open())

fields = reader.fieldnames

if not isinstance(fields, list):
    exit('Missing columns')

for col in cols:
    if col not in fields:
        exit(f'Invalid CSV file: Missing {col} field.')

model = Model(ENV_PATH)
db = model.connect()

for row in reader:
    res = db.product_categories.find_one({"code": row['code']})

    if res is not None:
        continue

    docs.append({
        "category": row["category"],
        "code": row["code"],
        "subcategory": row["subcategory"],
        "desc": row["desc"]
    })

if len(docs):
    res = db.product_categories.insert_many(docs)
    insertCount = len(res.inserted_ids)

    print(f'{insertCount} documents inserted')
else:
    print('No documents to insert')

model.con.close()
