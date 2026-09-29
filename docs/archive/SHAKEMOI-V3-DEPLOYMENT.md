# 🚀 SHAKEMOI V3 - DEPLOYMENT GUIDE

**Date:** 2026-01-13  
**Objectif:** App complète avec effet WOW

---

## 🗄️ PHASE 1: SUPABASE SETUP

### SQL à exécuter:

```sql
-- 1. Add columns
ALTER TABLE users_profile 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS profile_color TEXT DEFAULT '#A78BFA',
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS reshake_comment TEXT;

-- 2. Migrate data
UPDATE users_profile SET display_name = username WHERE display_name IS NULL OR display_name = '';
UPDATE users_profile SET profile_color = '#A78BFA' WHERE profile_color IS NULL;

-- 3. Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- 4. Trigger display_name
CREATE OR REPLACE FUNCTION ensure_display_name() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := NEW.username;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_display_name_trigger ON users_profile;
CREATE TRIGGER ensure_display_name_trigger BEFORE INSERT OR UPDATE ON users_profile FOR EACH ROW EXECUTE FUNCTION ensure_display_name();
```

---

## 📸 FEATURES À IMPLÉMENTER

### 1. Avatar Upload (30min)
- Component dans EditProfileDialog
- Upload vers storage.buckets['avatars']
- Resize client-side
- Display partout

### 2. Couleurs Pastel (20min)
- Palette 10 couleurs
- ColorPicker component
- Dans OnboardingDialog + EditProfileDialog
- Gradient header profil

### 3. Reshakes Visibles (15min)
- Debug getUserReshakes()
- Afficher dans ProfileView tab
- @reshaker dans feed

### 4. Shake un Son (20min)
- SearchView dans ShakeTabsDialog
- Création post
- Refresh feed

### 5. UX Polish (25min)
- Animations
- Empty states
- Loading skeletons
- Error handling

---

## ⏱️ TIMELINE

- 00h00-00h15: SQL + Storage setup
- 00h15-00h45: Avatar upload
- 00h45-01h05: Couleurs pastel
- 01h05-01h35: Features sociales
- 01h35-02h00: Polish + tests

---

**TOTAL: 2h de développement intensif**
