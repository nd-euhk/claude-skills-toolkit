# Commit Message Standards

## Format
```
type(scope): description
```

## Types (priority order)
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting (no logic change)
- `refactor`: Restructure without behavior change
- `test`: Tests
- `chore`: Maintenance, deps, config
- `perf`: Performance
- `build`: Build system
- `ci`: CI/CD

## Rules
- **Always use Vietnamese with diacritics**
- **Title: <72 characters, Focus on WHAT, not HOW**
- **Body: Explain WHY, not WHAT** (Optional, If complex changed)
- **Present tense, imperative** ("add" not "added")
- **No period at end**
- **Scope optional but recommended**
- **Always create NEW Commit**
- **Never using `--amend` unless specifically requested by the human**
- **Never skip git hooks unless specifically requested by the human** (`--no-verify`)
- **Raise Human if there is nothing to commit**
- Only use `feat`, `fix`, or `perf` prefixes for files in `.claude` directory (do not use `docs`).

## NEVER Include AI Attribution
- ❌ "Generated with Claude"
- ❌ "Co-Authored-By: Claude"
- ❌ Any AI reference

## Good Examples
- `feat(auth): add login validation`
- `fix(api): resolve query timeout`
- `docs(readme): update install guide`
- `refactor(utils): simplify date logic`

## Bad Examples
- ❌ `Updated files` (not descriptive)
- ❌ `feat(auth): added login using bcrypt with salt` (too long, describes HOW)
- ❌ `Fix bug` (not specific)

## Special Cases
- `.claude/` skill updates: `perf(skill): improve token efficiency`
- `.claude/` new skills: `feat(skill): add database-optimizer`
