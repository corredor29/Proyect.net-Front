# AutoTaller Manager Frontend

Frontend web del sistema **AutoTaller Manager**. Este proyecto consume una API REST para gestionar clientes, vehiculos, citas, ordenes de servicio, cotizaciones, facturas, repuestos, proveedores, usuarios y auditoria.

## Descripcion

La aplicacion esta construida con HTML, CSS y JavaScript vanilla. No requiere proceso de compilacion y funciona como un frontend estatico que se conecta al backend en:

`http://localhost:5081/api`

Tambien integra:

- autenticacion por correo y contrasena
- inicio de sesion con Google
- control de acceso por roles
- manejo de rate limiting `429`
- notificaciones en tiempo real con SignalR
- graficos en el dashboard con Chart.js

## Modulos principales

- `index.html`: inicio de sesion
- `register.html`: registro de usuarios
- `Dashboard.html`: panel principal con metricas, graficos y notificaciones
- `pages/customers.html`: gestion de clientes
- `pages/vehicles.html`: gestion de vehiculos
- `pages/service-orders.html`: gestion de ordenes de servicio
- `pages/appointments.html`: gestion de citas
- `pages/quotations.html`: gestion de cotizaciones
- `pages/invoices.html`: gestion de facturas
- `pages/suppliers.html`: gestion de proveedores
- `pages/parts.html`: gestion de repuestos
- `pages/users.html`: administracion de usuarios
- `pages/audit-logs.html`: consulta de auditoria
- `rate-limit.html`: pantalla de espera cuando la API responde `429 Too Many Requests`

## Roles soportados

El frontend aplica permisos segun el rol guardado en sesion:

- `Admin`
- `Receptionist`
- `Mechanic`

Los permisos se gestionan desde `js/auth.js`, ocultando opciones del menu y bloqueando pantallas no autorizadas.

## Estructura del proyecto

```text
.
|-- index.html
|-- register.html
|-- Dashboard.html
|-- rate-limit.html
|-- css/
|-- js/
`-- pages/
```

## Requisitos

- navegador moderno
- backend de AutoTaller ejecutandose en `http://localhost:5081`
- acceso a internet para cargar librerias CDN:
  - Tabler Icons
  - Chart.js
  - Microsoft SignalR

## Como ejecutar

Como es un proyecto estatico, puedes abrirlo con cualquier servidor local. Por ejemplo:

### Opcion 1: VS Code Live Server

1. Abre la carpeta del proyecto.
2. Ejecuta Live Server sobre `index.html`.

Luego abre:

`http://localhost:5500/index.html`

## Flujo de autenticacion

- `js/login.js` consume `POST /auth/login`
- `js/register.js` consume `POST /auth/register`
- el boton de Google redirige a `http://localhost:5081/api/auth/google`
- `js/auth.js` guarda `token` y `user` en `localStorage`
- si la API responde `401`, el usuario cierra sesion automaticamente

## Integracion con la API

La base de consumo HTTP se encuentra en `js/api.js`. Desde ahi se configuran:

- `Authorization: Bearer <token>`
- serializacion JSON
- redireccion por `401 Unauthorized`
- redireccion a `rate-limit.html` cuando la API responde `429`

Si el backend corre en otra URL o puerto, actualiza la constante:

```js
const API_BASE = 'http://localhost:5081/api';
```

## Archivos clave

- `js/api.js`: cliente HTTP comun
- `js/auth.js`: sesion, roles y proteccion de rutas
- `js/notifications.js`: notificaciones en tiempo real
- `js/Dashboard.js`: logica del panel principal
- `css/`: estilos por vista
- `pages/`: modulos internos del sistema

## Link 

https://proyect-net-front.onrender.com

