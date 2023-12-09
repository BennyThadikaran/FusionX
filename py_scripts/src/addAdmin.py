from pathlib import Path
from Model import Model
from sys import argv

##
# Assigns an `admin` role to an existing user in MongoDB users collection
# py addAdmin.py '<User Email Id>'
##

DIR = Path(__file__).parent
ENV_PATH = DIR.parent / '..' / 'src' / '.env'

if len(argv) == 1:
    exit('Pass an email id to assign `admin` role.')

email = argv[1]

# very minimal email validation
if '@' not in email or '.' not in email:
    exit('Not a valid email')

model = Model(ENV_PATH)

db = model.connect()

result = db.users.update_one({'email': email}, {"$set": {'role': 'admin'}})

if result.modified_count == 1:
    print('Done')
else:
    print(f'''Failed
Matched: {result.matched_count}
Modified: {result.modified_count}''')

model.con.close()
