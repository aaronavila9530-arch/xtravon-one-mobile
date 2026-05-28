# ERP EL SURCO Mobile

App movil iOS/Android para operar el ERP EL SURCO desde campo, patio, supervision y cliente.

## Modulos incluidos

- Login por perfil de prueba: Supervisor, Operador Patio, Cliente.
- Dashboard bajo demanda.
- Operaciones de buque y cuotas.
- Escaneo QR con camara.
- Aprobaciones documentales.
- Informes por buque con cuota vs retiro y alertas.
- Portal cliente.

## Backend

La app no debe tener el API hardcoded en codigo. Configure el endpoint por ambiente antes de compilar o publicar updates:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="https://tu-backend.railway.app"
```

Tambien puede usar variables por variante:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL_CELULAR="https://tu-backend.railway.app"
$env:EXPO_PUBLIC_API_BASE_URL_HANDHELD="https://tu-backend.railway.app"
```

En EAS/Railway/CI, configure las mismas variables como variables de ambiente. Use `mobile/.env.example` como plantilla local.

## Ejecutar

En una maquina con Node + npm:

```powershell
cd "C:\Users\Aaron Avila\Documents\ERP EL Surco\mobile"
npm install
npm run android
```

Para iOS:

```powershell
npm run ios
```

En Windows normalmente iOS se prueba con Expo Go en un iPhone fisico o desde macOS/Xcode.

## Siguientes pasos tecnicos

- Reemplazar login de prueba por JWT real.
- Agregar subida real de evidencias con `expo-image-picker`.
- Agregar firma digital tactil.
- Generar/descargar PDF desde backend.
- Activar permisos por modulo desde RBAC.
- Agregar modo offline con cola local para escaneos sin internet.
