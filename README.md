# HELLBOUND

FPS rétro façon DOOM avec des graphismes modernes (three.js : éclairage dynamique, bump mapping, bloom, aberration chromatique, grain), jouable sur **PC** et **mobile** directement dans le navigateur.

## Jouer

- **PC** : `ZQSD` bouger · souris viser · clic tirer · `Shift` courir · `1`/`2`/molette armes · `M` son · `Échap` pause
- **Mobile** (paysage) : stick à gauche pour bouger (pousser à fond = courir) · glisser à droite pour viser · bouton **TIR** · bouton **ARME**

Niveaux générés procéduralement. Tuez tous les démons, puis rejoignez le portail vert.

## Développement

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # sortie dans dist/
```

Tout est procédural (textures, sons, musique, modèles) : aucun asset externe.

## Déploiement

Chaque push déclenche `.github/workflows/deploy.yml` (GitHub Pages). Le domaine est défini dans `public/CNAME`
(`hellbound.linkin-tools.fr`) : il faut un enregistrement DNS `CNAME hellbound → clementchatain.github.io`.
