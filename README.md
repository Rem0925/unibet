# UniBet

Plataforma privada de mercados de predicción pari-mutuel en USDT con recargas y retiros vía Binance Pay.

## Stack

- **Frontend / Backend:** Next.js 16 (App Router, React 19, TypeScript) + Tailwind CSS
- **Base de datos & Auth:** Supabase (PostgreSQL + RLS)
- **Pagos:** Binance Pay API

## Inicio Rápido

1. Clona el repositorio e instala las dependencias:
```bash
npm install
```

2. Configura las variables de entorno en `.env.local`:
```bash
cp .env.example .env.local
```

3. Ejecuta el esquema `schema.sql` en el SQL Editor de tu proyecto en Supabase.

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
