from pathlib import Path
from Model import Model
from Templates import FoamRoller, Clothes, ExerciseBands

DIR = Path(__file__).parent

if __name__ == '__main__':
    env_path = DIR.parent / '..' / 'src' / '.env'

    db = Model(env_path)

    with FoamRoller(DIR / 'tsv' / 'foam-roller.tsv', db) as tmp:
        tmp.run()

    with Clothes(DIR / 'tsv' / 'clothes.tsv', db) as tmp:
        tmp.run()

    with ExerciseBands(DIR / 'tsv' / 'exercise-bands.tsv', db) as tmp:
        tmp.run()
