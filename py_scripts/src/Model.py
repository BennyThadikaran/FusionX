from pymongo import MongoClient
from pathlib import Path


class Model:

    def __init__(self, env_path: Path):
        self.con_string = self._getConnectionString(env_path)

    def connect(self, dbName="fusionx"):
        self.con = MongoClient(self.con_string)
        self.db = self.con[dbName]
        return self.db

    @staticmethod
    def _getConnectionString(env_path: Path):
        if not env_path.exists():
            raise FileNotFoundError(env_path)

        for line in env_path.read_text().split('\n'):
            if ('MONGO_CONN_STRING') in line:
                return line[line.find('=') + 1:]
        raise LookupError('MONGO_CONN_STRING not set in .env')
