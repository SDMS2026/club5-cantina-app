# Club 5 — Cantina Escolar Management System

<div align="center">

![Club 5 Banner](public/club5logo-transparent.png)

### **Sistema Moderno de Punto de Venta (POS), Facturación Bimoneda e Inventario Escolar**
**Desarrollado con excelencia por [SyncLogic](https://github.com/SDMS2026)**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.6_(App_Router)-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini_1.5_Flash-Voice_to_Order-8E75C4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)

</div>

---

## 📋 Descripción del Proyecto

**Club 5 Cantina Escolar** es una plataforma integral de gestión comercial diseñada para modernizar y agilizar las operaciones diarias de una cantina escolar o cafetín institucional. 

Construida con un diseño **100% responsivo** y optimizado para cualquier dispositivo (desde smartphones y tablets hasta pantallas de escritorio), combina la velocidad de cobro con transacciones en tiempo real, control de stock, gestión de fiados escolares y cuentas por pagar a proveedores en un entorno bimoneda (USD / Bs.) sincronizado en vivo con la tasa oficial del BCV.

Además, incorpora una función experimental de **Voice-to-Order con Gemini 1.5 Flash**, permitiendo dictar comandas por voz mediante lenguaje natural que la inteligencia artificial interpreta y convierte automáticamente en productos añadidos al carrito.

---

## ✨ Características Principales

### 🛒 1. Punto de Venta (POS) de Alto Rendimiento
- **Cobro Rápido en Pocos Clics**: Búsqueda instantánea de productos con filtros por categoría (Comida, Bebidas, Snacks, Dulces, Combos).
- **Facturación Bimoneda Automatizada**: Cálculo simultáneo en Dólares (\$ USD) y Bolívares (Bs.) sincronizado con la tasa oficial del Banco Central de Venezuela (BCV).
- **Múltiples Métodos de Pago**: Efectivo USD, Efectivo Bs., Pago Móvil, Punto de Venta Débito y Fiado Escolar.
- **Carrito Flotante / Móvil Adaptable**: Drawer interactivo con control de cantidades, eliminación rápida y resumen financiero.

### 🎙️ 2. Voice-to-Order (IA Experimental con Gemini 1.5 Flash)
- **Dictado de Comandas por Voz**: Grabación de notas de voz en el navegador con Web Audio API (`MediaRecorder`).
- **Procesamiento de Lenguaje Natural**: Envío del audio procesado a la API de **Google Gemini 1.5 Flash** para identificar nombres de productos, sinónimos, cantidades y clientes en una sola pasada.
- **Auto-Añadido al Carrito**: Carga directa de los ítems en la comanda con tolerancia a variantes léxicas y fonéticas.

### 📦 3. Inventario y Catálogo de Productos
- Visualización de existencias en tiempo real con alertas de stock bajo y agotado.
- Modal deslizable touch-friendly con bloqueo de scroll inferior (body scroll lock).
- Creación, edición rápida de precios, margen y visibilidad de productos.

### 💳 4. Cuentas por Cobrar (Fiados y Crédito Escolar)
- Registro y control de consumos a crédito por estudiante o personal educativo.
- Historial detallado de compras no liquidadas con cálculo automático de deuda en Bs. y USD.
- Liquidación parcial o total con emisión de recibos digitales.

### 🚚 5. Cuentas por Pagar (Proveedores)
- Gestión de facturas y deudas a distribuidores mayoristas con fechas de vencimiento.
- Alertas inteligentes en barra lateral (cuentas vencidas, próximas a vencer en ≤ 3 días y pagadas).

### 👥 6. Directorio Escolar y Representantes
- Padrón de estudiantes clasificados por grado y sección.
- Vinculación con representantes legales, números de contacto y cargos institucionales.

### 🔒 7. Seguridad y Control de Acceso (Supabase Auth)
- Autenticación segura de usuarios y operadores del sistema.
- Protección integral de rutas en el servidor con **Next.js 16 Proxy / Middleware** (`@supabase/ssr`).
- Redirección automática de accesos no autorizados a la pantalla de `/login`.
- Cierre de sesión centralizado desde el menú lateral.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework Web** | [Next.js 16 (App Router)](https://nextjs.org/) con compilador [Turbopack](https://turbo.build/) |
| **Biblioteca UI** | [React 19](https://react.dev/) |
| **Lenguaje** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Estilos y Diseño** | [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/) |
| **Animaciones** | [Framer Motion](https://www.framer.com/motion/) |
| **Modales & Accesibilidad** | [Radix UI](https://www.radix-ui.com/) |
| **Base de Datos & Auth** | [Supabase](https://supabase.com/) (PostgreSQL & Supabase Auth SSR) |
| **Inteligencia Artificial** | [Google Gemini 1.5 Flash API](https://ai.google.dev/) (Voice-to-Order) |

---

## 🚀 Inicio Rápido

Sigue estos sencillos pasos para levantar el entorno de desarrollo localmente:

### 1. Clonar el Repositorio
```bash
git clone https://github.com/SDMS2026/club5-cantina-app.git
cd club5-cantina-app
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Copia el archivo de ejemplo `.env.example` y nómbralo `.env.local`:
```bash
cp .env.example .env.local
```

Rellena las variables en `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
GEMINI_API_KEY=tu_api_key_de_google_gemini
```

### 4. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000) para acceder a la aplicación.

---

## 📱 Experiencia Responsive

Diseñado bajo la filosofía **Mobile-First**:
- **Smartphones (320px - 480px)**: Barra superior sticky con hamburguesa, catálogo táctil y botón flotante de comanda.
- **Tablets (768px - 1024px)**: Panel flexible de dos columnas con navegación colapsable.
- **Escritorio (> 1024px)**: Sidebar interactivo con tasa BCV en vivo, estado del sistema y acceso directo al POS.

---

## 👨‍💻 Autor & Créditos

Este sistema ha sido diseñado y desarrollado con excelencia por:

**SyncLogic**  
*Desarrollo de Soluciones de Software de Alto Impacto*  
GitHub: [@SDMS2026](https://github.com/SDMS2026)

---

&copy; 2026 Club 5 Cantina Escolar &bull; Todos los derechos reservados.
