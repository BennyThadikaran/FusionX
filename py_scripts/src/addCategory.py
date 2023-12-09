from pathlib import Path
from Model import Model
from csv import DictReader
from sys import argv

DIR = Path(__file__).parent
ENV_PATH = DIR.parent / '..' / 'src' / '.env'

model = Model(ENV_PATH)

db = model.connect()
docs = []

for file in argv[1:]:
    file = Path(file)

    if not file.exists():
        exit('File does not exist')

    reader = DictReader(file.open())

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
