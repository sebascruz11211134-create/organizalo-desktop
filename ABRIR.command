#!/bin/bash
# Organízalo.AI Desktop — script de arranque para Mac
# Doble-click para abrir

cd "$(dirname "$0")"

echo "========================================"
echo "  Organízalo.AI Desktop"
echo "========================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado."
  echo "   Descárgalo en: https://nodejs.org"
  echo ""
  read -p "Presiona Enter para salir..."
  exit 1
fi

echo "✓ Node.js $(node --version)"

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 Instalando dependencias (primera vez, puede tardar 1-2 min)..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ Error al instalar dependencias."
    read -p "Presiona Enter para salir..."
    exit 1
  fi
fi

echo ""
echo "🚀 Abriendo Organízalo.AI Desktop..."
echo "   (cierra esta ventana para detener el app)"
echo ""

npm run dev
