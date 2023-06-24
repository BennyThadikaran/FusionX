from pymongo import MongoClient


class Model:

    def __init__(self, env_path):
        self.con_string = self.getConnectionString(env_path)

    def connect(self):
        self.con = MongoClient(self.con_string)
        self.db = self.con.fusiony

    @staticmethod
    def getConnectionString(env_path):
        if not env_path.exists():
            raise FileNotFoundError(env_path)

        for line in env_path.read_text().split('\n'):
            if ('MONGO_CONN_STRING') in line:
                return line[line.find('=') + 1:]
        raise LookupError('MONGO_CONN_STRING not set in .env')
