# PosteLink Studio — Vercel Ready

Projet prêt à pousser sur GitHub puis à importer dans Vercel.

## Déploiement Vercel
1. Crée un dépôt GitHub.
2. Copie ce projet dedans.
3. Sur Vercel: **New Project** → **Import Git Repository**.
4. Ajoute les variables d'environnement depuis `.env.example` dans **Settings → Environment Variables**.
5. Déploie.

## Sécurité
- Les secrets restent côté **serveur** dans les routes `/api/*`.
- Aucune clé n'est exposée dans le navigateur si tu n'utilises pas de variables `NEXT_PUBLIC_*`.
- `productionBrowserSourceMaps` est désactivé.
- Tu dois activer dans Vercel **Security → Build Logs and Source Protection** et garder la protection active.

## IA gratuite / faible coût
- **Hugging Face Inference Providers**: une seule API pour de nombreux modèles open-weight.
- **Cloudflare Workers AI**: allocation gratuite journalière, pratique pour un assistant léger.

## Ce que fait le projet
- Import PDF / XLSX / XLS / CSV
- Analyse des liens et des anomalies
- Édition locale
- Export dans le même format que l'import
- Route API IA côté serveur
