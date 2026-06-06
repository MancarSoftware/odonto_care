# PostgreSQL para el instalador

Esta carpeta recibe una distribucion binaria oficial de PostgreSQL 16 para
Windows x64. El contenido debe conservar la estructura original:

```text
vendor/postgresql/
  bin/
    postgres.exe
    initdb.exe
    pg_ctl.exe
    pg_dump.exe
    pg_isready.exe
    psql.exe
    createdb.exe
  lib/
  share/
```

No copies solamente `bin`: PostgreSQL necesita tambien sus bibliotecas,
extensiones, zonas horarias y archivos de soporte.

Los binarios no se guardan en Git por su tamano. El comando
`npm run runtime:verify` impide crear un instalador incompleto.
