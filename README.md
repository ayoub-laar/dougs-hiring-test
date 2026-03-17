# Test technique - Validation de synchronisation bancaire

## Prérequis

- Node.js >= 22
- npm >= 10

## Lancer le projet

```bash
npm install
npm run start:dev
```

## Lancer les tests

```bash
# Tests unitaires
npm run test

# Tests d'intégration
npm run test:e2e
```

---

## Problème

Les prestataires de synchronisation bancaire remontent parfois des opérations en doublon ou en manquent certaines. Pour détecter ces anomalies, le client fournit ses relevés bancaires dont les soldes font office de points de contrôle fiables.

L'objectif est de comparer les opérations synchronisées avec ces soldes pour détecter toute incohérence, et le cas échéant, fournir au comptable les informations nécessaires pour corriger manuellement.

---

## Algorithme

Un relevé bancaire fournit un solde à une date donnée. Ce solde représente le cumul de toutes les opérations depuis l'ouverture du compte. En conséquence, la différence entre deux soldes consécutifs est égale à la somme des opérations intervenues entre ces deux dates.

Pour chaque paire de points de contrôle consécutifs `(D1, B1)` et `(D2, B2)` :

```
somme des opérations bancaires dans ]D1, D2] = B2 - B1
```

Si cette égalité n'est pas respectée, la période est en anomalie.

**Pourquoi l'intervalle `]D1, D2]` (start exclu, end inclus) ?**
Le solde `B1` à la date `D1` inclut déjà les opérations bancaires du jour `D1` (solde de fin de journée). Ces opérations ne doivent donc pas être recomptées dans la période suivante. En revanche, les opérations du jour `D2` contribuent au solde `B2` et font partie du delta `B2 - B1`.

**Détection de doublons**
En cas d'anomalie sur une période, l'algorithme recherche des opérations bancaires partageant le même triplet `(date, libellé, montant)`. Ces suspects sont remontés dans la réponse pour guider le comptable.

---

## Hypothèses

- Le solde d'un point de contrôle représente le solde **en fin de journée** à la date indiquée, conformément au fonctionnement réel des banques, qui calculent et affichent les soldes après traitement de toutes les opérations de la journée.
- Les dates sont des dates calendaires sans composante horaire (granularité jour).
- Les opérations bancaires situées avant le premier point de contrôle ou après le dernier sont **ignorées**, aucune référence ne permet de les vérifier.
- L'algorithme ne présuppose **aucune périodicité** entre les relevés : ils peuvent être mensuels, trimestriels ou irréguliers.

---

## Structure de la réponse en cas d'anomalie

```json
{
  "message": "Validation failed",
  "reasons": [
    {
      "period": { "start": "2026-01-01", "end": "2026-01-31" },
      "expectedDelta": 2000,
      "actualDelta": 3000,
      "difference": 1000,
      "suspectedDuplicates": [
        {
          "original":  { "id": 1, "date": "2026-01-15", "label": "Salaire", "amount": 3000 },
          "duplicate": { "id": 3, "date": "2026-01-15", "label": "Salaire", "amount": 3000 }
        }
      ]
    }
  ]
}
```

Chaque `reason` indique la période concernée, l'écart constaté et les doublons suspects. Si `suspectedDuplicates` est vide, le comptable doit rechercher une opération manquante d'un montant égal à `difference`.

---

## Choix techniques

**NestJS** est explicitement demandé dans le livrable. La structure suit l'architecture modulaire native du framework avec une séparation stricte des responsabilités : le controller gère uniquement le routing HTTP, le service contient toute la logique métier, le DTO protège le service des données invalides. Cette séparation permet de tester chaque couche indépendamment et de modifier l'une sans impacter les autres (le service peut par exemple être appelé depuis un job ou un CLI sans aucune modification).

**`class-validator` / `class-transformer`** permettent de valider le body de la requête de façon déclarative via des décorateurs sur le DTO. Le `ValidationPipe` global rejette automatiquement toute requête malformée avant qu'elle n'atteigne le service.

**Comparaison en centimes** (`Math.round(amount * 100)`) pour éviter les erreurs d'arrondi inhérentes aux flottants JavaScript (`0.1 + 0.2 !== 0.3`).

**Tests unitaires** sur le service uniquement : l'algorithme est le cœur du projet, il mérite une couverture fine des cas métier. Les tests d'intégration couvrent la couche HTTP (routing, DTO, sérialisation) sans dupliquer les cas déjà testés unitairement.