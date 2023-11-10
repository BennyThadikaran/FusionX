from Model import Model
from pathlib import Path

##
# Bulk upload all pincodes to Mongodb database
##

DIR = Path(__file__).parent
ENV_PATH = DIR.parent / '..' / 'src' / '.env'
CSV_PATH = DIR / 'pincode.csv'

model = Model(ENV_PATH)
db = model.connect()
docs = []

with CSV_PATH.open() as f:
    f.readline()

    print("Collating...")
    while line := f.readline().strip('\n'):

        pincode, region, state = line.split(',')

        docs.append({
            'Pincode': pincode,
            'District': region,
            'State': state
        })

print(f'Inserting {len(docs)} pincodes')

db.pincodes.insert_many(docs)

inserted_count = model.db.pincodes.count_documents()

model.con.close()

print(f'Done. Inserted {inserted_count} pincodes')
