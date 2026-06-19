# Interface base para os adaptadores de dados

class BaseSourceAdapter:
    def load_data(self, municipio: str, db_session):
        raise NotImplementedError("Subclasses devem implementar load_data()")
