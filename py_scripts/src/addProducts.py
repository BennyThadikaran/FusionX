from pathlib import Path
from Model import Model
from Templates import FoamRoller, Clothes, ExerciseBands

##
# Add products to Mongodb db database
#
# Refer documentation in Templates.py to create a new Category class
# that implements the BaseTemplate class.
#
# See example at the end to generate a new template file.
##

DIR = Path(__file__).parent

ENV_PATH = DIR.parent / '..' / 'src' / '.env'
FOAMROLLER_PATH = DIR / 'tsv' / 'foam-roller.tsv'
CLOTHES_PATH = DIR / 'tsv' / 'clothes.tsv'
EXERCISEBANDS_PATH = DIR / 'tsv' / 'exercise-bands.tsv'

db = Model(ENV_PATH)

with FoamRoller(FOAMROLLER_PATH, db) as tmp:
    tmp.run()

with Clothes(CLOTHES_PATH, db) as tmp:
    tmp.run()

with ExerciseBands(EXERCISEBANDS_PATH, db) as tmp:
    tmp.run()

##
# To generate a file see commented example below
# 1. Create a category class (must extend BaseTemplate) in Templates.py
# 2. Import the class in this file
# 3. Store the file path to output the template file as a pathlib.path variable.
# 4. Instantiate the class and call the 'generate_file' method
##

# MOBILES_PATH = DIR / 'tsv' / 'mobiles.tsv'

# with Mobiles(MOBILES_PATH, db) as tmp:
#     tmp.generate_file()
