#!/bin/bash

# @umituz/web-localization Quick Setup Script
# This script helps you quickly integrate the package into your project

set -e

echo "🌍 @umituz/web-localization Setup"
echo "=================================="
echo ""

# Check if we're in a project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from your project root."
    exit 1
fi

# Check if src directory exists
if [ ! -d "src" ]; then
    echo "❌ Error: src directory not found. Please run this script from your project root."
    exit 1
fi

echo "✅ Found project structure"
echo ""

# Install package
echo "📦 Installing @umituz/web-localization..."
npm install @umituz/web-localization

# Create i18n directory
echo "📁 Creating i18n structure..."
mkdir -p src/i18n/locales

# Create i18n config from template
echo "⚙️  Creating i18n configuration..."
cat > src/i18n.ts << 'EOF'
import { setupI18n } from '@umituz/web-localization/setup';
import enUS from './i18n/locales/en-US.json';
import trTR from './i18n/locales/tr-TR.json';

setupI18n({
  resources: {
    'en-US': { translation: enUS.translation },
    'tr-TR': { translation: trTR.translation },
  },
  defaultLng: 'en-US',
  fallbackLng: 'en-US',
});
EOF

# Create en-US JSON
echo "📝 Creating en-US.json..."
cat > src/i18n/locales/en-US.json << 'EOF'
{
  "translation": {
    "app": {
      "title": "Your App Name",
      "description": "Your app description"
    },
    "nav": {
      "home": "Home",
      "about": "About",
      "contact": "Contact"
    },
    "hero": {
      "title": "Welcome to Our App",
      "subtitle": "Build something amazing",
      "cta": "Get Started"
    },
    "common": {
      "loading": "Loading...",
      "login": "Login",
      "signup": "Sign Up"
    }
  }
}
EOF

# Create tr-TR JSON
echo "📝 Creating tr-TR.json..."
cat > src/i18n/locales/tr-TR.json << 'EOF'
{
  "translation": {
    "app": {
      "title": "Uygulamanız",
      "description": "Uygulama açıklamanız"
    },
    "nav": {
      "home": "Ana Sayfa",
      "about": "Hakkında",
      "contact": "İletişim"
    },
    "hero": {
      "title": "Uygulamamıza Hoş Geldiniz",
      "subtitle": "Harika bir şeyler inşa edin",
      "cta": "Başla"
    },
    "common": {
      "loading": "Yükleniyor...",
      "login": "Giriş",
      "signup": "Kayıt Ol"
    }
  }
}
EOF

# Add scripts to package.json
echo "📜 Adding npm scripts..."
if command -v jq &> /dev/null; then
    # Using jq if available
    jq '.scripts["i18n:sync"] = "web-loc sync --locales-dir src/i18n/locales --base-lang en-US"' \
        package.json > package.json.tmp && mv package.json.tmp package.json
    jq '.scripts["i18n:translate"] = "web-loc translate --locales-dir src/i18n/locales --base-lang en-US"' \
        package.json > package.json.tmp && mv package.json.tmp package.json
else
    echo "⚠️  jq not found. Please add these scripts manually to package.json:"
    echo '  "i18n:sync": "web-loc sync --locales-dir src/i18n/locales --base-lang en-US"'
    echo '  "i18n:translate": "web-loc translate --locales-dir src/i18n/locales --base-lang en-US"'
fi

# Check if main.tsx exists and add import
if [ -f "src/main.tsx" ]; then
    echo ""
    echo "⚠️  MANUAL STEP REQUIRED:"
    echo "Add this line to src/main.tsx before ReactDOM.createRoot():"
    echo ""
    echo "  import './i18n';"
    echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Add 'import './i18n';' to src/main.tsx"
echo "  2. Use translations: const { t } = useTranslation();"
echo "  3. Test: npm run dev"
echo ""
echo "📖 For more info, see: skills/SKILL.md"
echo ""
