"""
Script de reparo: regenera a base de referência de Capim Branco com dados corretos.

1. Re-processa ElevacaoSourceAdapter (agora com bbox clipping ao imóvel)
2. Re-processa gerar_base_municipio (agora clip USO_RESTRITO ao polígono do imóvel)

Execute: python scripts/reparar_capim_branco.py
"""
import sys
import logging
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from db.database import SessionLocal
from gerar_base_referencia import gerar_base_municipio

MUNICIPIO = "Capim Branco"


def main():
    with SessionLocal() as db:
        from sources.elevacao import ElevacaoSourceAdapter

        print(f"\n=== 1. Re-processando ElevacaoSourceAdapter para {MUNICIPIO} ===")
        print("(Clipa o DEM à bbox do imóvel — ~30s)")
        ElevacaoSourceAdapter().load_data(MUNICIPIO, db)

        print(f"\n=== 2. Re-gerando feicao_referencia para {MUNICIPIO} ===")
        resumo = gerar_base_municipio(MUNICIPIO, db)

        print("\n=== Resumo ===")
        for tipo, count in resumo.items():
            print(f"  {tipo}: {count}")
        total = sum(resumo.values())
        print(f"  TOTAL: {total}")

    print("\nPronto! Reinicie o backend para invalidar o cache.")


if __name__ == "__main__":
    main()
