# Moki

Constructor de agentes. Las reglas de negocio viven en FOUNDATION.md y la arquitectura y el avance en ARCHITECTURE.md.

## Desarrollo local

Instala las dependencias con `npm ci` y arranca con `npm run dev`.
La página inicial funciona sin credenciales. Montserrat se sirve localmente desde el paquete de fuentes.

La página principal muestra el Constructor migrado del prototipo: agrega bloques por clic o arrastre, edita instrucciones y ordena con las flechas. El chat está en **simulación visual**, sin llamadas de IA. Guardar comprueba título y descripción, pero la persistencia sigue pendiente; al recargar se pierde el borrador. La conexión API del Sprint 2 también sigue pendiente. `npm run test:builder` verifica las interacciones de estado sin ejecutar pruebas del LLM.

Verificaciones: `npm run lint`, `npm run typecheck`, `npm run check:architecture` y `npm run build`.

## Core — Sprint 1

`npm test` ejecuta las pruebas con el runner integrado de Node.js (Node 22.18+ para ejecutar TypeScript directamente; verificado con Node 26.5). No requieren credenciales, red ni un framework de pruebas. Los dobles de repositorio, modelo y eventos están en `tests/core`, fuera del dominio.

`npm run typecheck:core` verifica el core por separado, únicamente con la biblioteca estándar de ECMAScript: sin tipos de Node, DOM, React o proveedores. Los imports `.ts` permiten ejecutar las pruebas sin compilación adicional.

`RunAgent` recibe repositorio, modelo, catálogo disponible, receptor de eventos y generador de IDs. Valida antes de ejecutar, pasa la salida de cada bloque al siguiente y termina ante el primer fallo. En este sprint solo se prueban bloques sin herramientas mediante un modelo falso. Los contratos para herramientas están definidos pero su ejecución todavía no está implementada. La política de contenido se incluye en cada solicitud; los mocks no demuestran cumplimiento de un modelo real.

## MiniMax — Sprint 2 en progreso

Configurar `MINIMAX_API_KEY` y `MINIMAX_MODEL` en `.env` o `.env.local`, tomando como plantilla `.env.example`. La clave se usa exclusivamente en el servidor. El modelo debe ser un ID habilitado en la cuenta; no se fija un proveedor ni un modelo en el core.

`src/adapters/llm/minimax.ts` implementa texto mediante la [API compatible con Anthropic de MiniMax](https://platform.minimax.io/docs/api-reference/text-anthropic-api) y el SDK `@anthropic-ai/sdk`, aislado detrás del puerto `LLMProvider`. El bloque `src/adapters/blocks/escribir.ts` aporta el manifiesto sin herramienta externa. Por ahora se rechazan explícitamente herramientas y salida estructurada: corresponden a otros sprints. La llamada tiene un tiempo máximo de 30 segundos, sin reintentos automáticos y un máximo técnico de 2048 tokens de salida; una respuesta truncada se considera un fallo.

`npm test` incluye pruebas del adaptador usando el SDK con transporte HTTP simulado. No consumen llamadas reales ni prueban que una cuenta de MiniMax esté configurada. La condición `react-server` permite probar módulos protegidos con `server-only` en Node.

Pendientes: resolver la autenticación de la ruta de prueba (Auth está previsto para el Sprint 4), implementar esa ruta y comprobar una ejecución real. No hay bypass de autenticación implementado.

## Supabase — configuración pendiente

Sprint 4 iniciado. Pantallas disponibles: `/login`, `/recuperar-contrasena`, `/cambiar-contrasena` y `/cuenta` (sesión y cierre de sesión). Registro y perfil no se integran hasta que Diego confirme `sql/0002_profiles.sql`. La baja espera una decisión sobre el destino de los agentes del usuario.

La sesión de navegador usa el SDK de Auth en `shared/services/auth.ts`, con el flujo implícito soportado por Supabase. Autorizar en Supabase Auth > URL Configuration la URL de recuperación `http://127.0.0.1:3000/cambiar-contrasena` (y el origen de producción cuando exista). El enlace de correo establece la sesión mediante el SDK; la pantalla comprueba el usuario antes de permitir el cambio. No se ha validado aún con un proyecto real. `npm run test:auth` ejecuta pruebas aisladas sin cuentas ni envío de correos.

Ejecutar manualmente y en orden `0001_init.sql` y `0002_profiles.sql`, y confirmar resultados. La segunda migración crea la tabla, políticas y trigger; incluye perfiles para cuentas existentes. No contiene columnas de correo, ni tablas de agentes. Revisar en el SQL Editor el resultado y confirmar antes de continuar con registro/repositorio de perfiles.

Referencias: [Datos de usuarios y trigger](https://supabase.com/docs/guides/auth/managing-user-data), [Contraseñas](https://supabase.com/docs/guides/auth/passwords). La [baja de usuario mediante el SDK](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) requiere servidor con credencial administrativa; nunca se expondrá esa credencial en el navegador.

Usar un proyecto de Supabase y copiar `.env.example` a `.env.local`.
Completar la URL y la clave publicable desde los ajustes de API del proyecto.
No colocar claves secretas o `service_role` en variables `NEXT_PUBLIC_*`.

`src/adapters/persistence/client.ts` crea un cliente del SDK con acceso a DB (`from`), Auth (`auth`) y Storage (`storage`). Solo se importa desde el servidor y todavía no integra sesiones por usuario: eso corresponde al Sprint 4. No hay llamadas desde componentes ni repositorios de negocio implementados.

La creación/configuración del proyecto remoto y las comprobaciones reales de DB, Auth y Storage siguen pendientes. Compilar un cliente no demuestra conectividad remota.

Diego debe ejecutar manualmente `sql/0001_init.sql` en el SQL Editor de Supabase y confirmar el resultado. Es un punto de partida sin cambios de esquema: el Sprint 0 no necesita extensiones. No existen scripts que ejecuten migraciones.

Referencia del SDK: [Inicialización de Supabase](https://supabase.com/docs/reference/javascript/initializing).
Referencia del framework: [Instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation).

## Persistencia — Sprint 5 en espera de esquema

Migraciones preparadas: `sql/0003_agents.sql` y `sql/0004_steps.sql`. Ejecutarlas manualmente en orden, después de `0001` y `0002`, y confirmar el resultado antes de integrar repositorio/API/UI. Incluyen RLS, agentes, pasos ordenados y `moki_save_agent` para guardar una cadena en una sola transacción a través del SDK (`rpc`). Solo se revisaron estáticamente; no se han ejecutado ni probado contra una base de datos.

La baja de cuenta sigue pendiente de definición: no existe borrado automático de agentes al borrar el usuario. El esquema conserva la referencia al propietario y bloquea esa eliminación mientras tenga agentes, hasta implementar la política que confirme Diego.

Referencia técnica: [Funciones y permisos de Supabase](https://supabase.com/docs/guides/database/functions).

## Despliegue

El destino es el hosting estándar de Next.js en Vercel, con las mismas variables de entorno. DB, Auth y Storage corresponden a Supabase. Este sprint no publica la aplicación.
