"""
Insere os 50 CARs de exemplo no banco — APENAS os polígonos declarados.
MapBiomas, Hidrografia, DEM e diagnóstico são carregados on-demand
quando o analista clicar no CAR no site.
"""
import sys
import logging
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.database import SessionLocal, Base, engine
from db.models import Imovel

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

CARS_EXEMPLO = [
    "MG-3100401-C0FBC39308F84D53A96F194F255A9163",  # Acaiaca
    "MG-3100609-F4065F82B7B04F1CA900F1AE0D5E9C28",  # Agua Boa
    "MG-3100807-A049AD4671D5494CA828A48F8A46E905",  # Aguanil
    "MG-3101508-C6311FBAE8934A4BB6AE830EE01A597D",  # Alem Paraiba
    "MG-3153509-5C51A7F4840E4C3694A88B68DE0AEA1D",  # Alto Jequitiba
    "MG-3102902-6FEEE006079E4FD099005471FFBEFE74",  # Antonio Carlos
    "MG-3103900-4FFB8BE23D0147DF82CC4567BDA78A90",  # Araujos
    "MG-3105608-E26CE27A5B1140489FB4E94FFB06C2BB",  # Barbacena
    "MG-3106309-F023996637B24DFE955BBA40D50EE394",  # Belo Oriente
    "MG-3108404-82C17108EF17415BB45D875876D03333",  # Botelhos
    "MG-3112505-A86A8DE185BA41EBAF3DC94DEFA0EFD4",  # Capim Branco
    "MG-3112604-3E62AF8E0F464ACCA5CAFA80A45A3F62",  # Capinopolis
    "MG-3113503-F3092FBEAEB94398BBA3A4FED5589F2F",  # Carbonita
    "MG-3117603-6FE60A8090634C64953A64627F6D1E35",  # Conceicao do Para
    "MG-3117876-B3C8DE6CF8514615B340477715AB0382",  # Confins
    "MG-3119955-4FB1CA77A84D48A99B635302795E760C",  # Corrego Fundo
    "MG-3121001-495EF23BE8274014B083734B1CD5E263",  # Datas
    "MG-3123601-53B833560DC7406EAD711B17FF0F4979",  # Eloi Mendes
    "MG-3124104-8BCDCAEE5A6F4BFE8FD1149236FFB551",  # Esmeraldas
    "MG-3127370-08AEF5E3D93748E187E89CAB8E9EBA98",  # Goiabeira
    "MG-3127701-1F4BBA73692B42B189FDB1C615880E13",  # Governador Valadares
    "MG-3130200-A1C9E9201891498B8453950BCF70F4A8",  # Igaratinga
    "MG-3132206-A254CA48698A412E9BD8216F8EA31515",  # Itaguara
    "MG-3132909-4DEFA23B5404430C9CD91EDB691E1DDC",  # Itamogi
    "MG-3133204-D5DDEC2520404F3A95310518959DEF9B",  # Itanhomi
    "MG-3134301-86357918142F4DEABD218986662FA796",  # Itumirim
    "MG-3134806-CD15A8FCFBDA464AAE702FC0C16DDD1B",  # Jacui
    "MG-3135704-DB2267DAD1F4467184D16FADA6F8A8A2",  # Jequitiba
    "MG-3137106-3479941D23544CD8A4962798F14D2108",  # Lagamar
    "MG-3138302-BBDD6F7BFCB24CD7995CC9FF864D77E5",  # Leandro Ferreira
    "MG-3138708-1048D0604CF048B8BB42DC2939FFDCF8",  # Luminarias
    "MG-3142403-0D5F1FDD34EB43AA8A1DAF540D52B229",  # Moema
    "MG-3145901-EBFD8B37739046F88735865338233480",  # Ouro Branco
    "MG-3147907-D46039CC0C3642EB880A679FBF32FBE2",  # Passos
    "MG-3148103-E3F2C7EC866848CBB33EE17AA23128B8",  # Patrocinio
    "MG-3148608-44A7DCAA9E7A4441860E0045F45AFB12",  # Pecanha
    "MG-3149101-0339D5BC76F8496FB30567A743C1F32D",  # Pedralva
    "MG-3149408-4A8D9A0BEB234CE498F43F05FD688334",  # Pedro Teixeira
    "MG-3150158-70BBF988D0104DDEB7C7B3F7462DC6D2",  # Piedade de Caratinga
    "MG-3150505-E03F514A627449AA8002303E2FC61BAE",  # Pimenta
    "MG-3150539-BA6B115B6DAA4FC6BBE014B88B492E71",  # Pingo-d'Agua
    "MG-3157708-B77E9E146F824FDEB3B31BCBDE483D9F",  # Santa Juliana
    "MG-3159902-3693C742F43B439FB33608BBE2828095",  # Santo Antonio do Amparo
    "MG-3162500-5478826D95904805AD073766D1360FCA",  # Sao Joao del Rei
    "MG-3162708-8A4F71FA7C0A4F919228B6650529EC48",  # Sao Joao do Paraiso
    "MG-3163805-71991560AEDD412E84FF5D902CFD2B90",  # Sao Miguel do Anta
    "MG-3164472-F0D4330FB96249CD9B0C17480248627A",  # Sao Sebastiao do Anta
    "MG-3165503-38310B0C9BE24AE188403A7995307BE6",  # Sardoa
    "MG-3165800-1898B1F798BA4EDF964D57502D8B2C83",  # Senador Jose Bento
    "MG-3166907-82F2E08DA0BE4D04B0DE83E95A3B7771",  # Serrania
]


def seed():
    Base.metadata.create_all(bind=engine)

    import geopandas as gpd
    from shapely.geometry import MultiPolygon

    gpkg = Path(__file__).resolve().parent.parent / "data" / "minas_gerais" / "declarado.gpkg"
    logger.info(f"Lendo {len(CARS_EXEMPLO)} CARs do declarado.gpkg...")

    placeholders = ", ".join(f"'{c}'" for c in CARS_EXEMPLO)
    gdf = gpd.read_file(gpkg, where=f"cod_imovel IN ({placeholders})")
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    logger.info(f"  {len(gdf)} encontrados.")

    with SessionLocal() as db:
        inseridos = 0
        atualizados = 0
        for _, row in gdf.iterrows():
            cod = row["cod_imovel"]
            imovel_id = f"imovel_{cod}"
            geom = row.geometry
            if geom and geom.geom_type == "Polygon":
                geom = MultiPolygon([geom])

            municipio = str(row.get("municipio") or "Minas Gerais")
            wkt = f"SRID=4326;{geom.wkt}" if geom else None

            existente = db.query(Imovel).filter(Imovel.id == imovel_id).first()
            if existente:
                existente.municipio = municipio
                existente.poligono_declarado = wkt
                atualizados += 1
            else:
                db.add(Imovel(
                    id=imovel_id,
                    nome=cod,
                    municipio=municipio,
                    uf="MG",
                    numero_car=cod,
                    poligono_declarado=wkt,
                ))
                inseridos += 1

        db.commit()
        logger.info(f"  {inseridos} inseridos, {atualizados} atualizados.")
        logger.info("Pronto! Diagnóstico será calculado on-demand ao clicar no CAR.")


if __name__ == "__main__":
    seed()
