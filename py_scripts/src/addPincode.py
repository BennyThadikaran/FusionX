from Model import Model
from pathlib import Path

##
# Bulk upload all pincodes to Mongodb database
##

DIR = Path(__file__).parent
env_path = DIR.parent / '..' / 'src' / '.env'
csv_path = DIR / 'pincode.csv'

db = Model(env_path)
db.connect()
docs = []

with csv_path.open() as f:
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

db.db.pincodes.insert_many(docs)
inserted_count = db.db.pincodes.count_documents({})
db.con.close()

print(f'Done. Inserted {inserted_count} pincodes')
