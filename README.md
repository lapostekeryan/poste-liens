# PosteLiens

Version propre et légère pour Vercel.

## Déploiement
1. Remplacer le contenu du repository GitHub par ce projet.
2. Vérifier que `package.json`, `app/`, `next.config.mjs`, `tsconfig.json` et `vercel.json` sont bien à la racine.
3. Sur Vercel, laisser la **Root Directory vide** (racine du repo).
4. Redéployer.

## Si Vercel affichait 404 avant
Les causes les plus fréquentes sont :
- mauvais dossier racine dans Vercel ;
- fichiers du projet dans un sous-dossier au lieu de la racine ;
- déploiement avec build échoué.
