'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useAppStore } from '@/lib/mova/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Calendar,
  Car,
  Settings,
  LogOut,
  Pencil,
  Shield,
  Bell,
  Globe,
  Moon,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'

export default function ProfileView() {
  const { goBack, user, setView, logout } = useAppStore()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [notifications, setNotifications] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('mova_notif_pref') !== 'false' : true
  )
  const [language, setLanguage] = useState(() =>
    (typeof window !== 'undefined' ? localStorage.getItem('mova_lang_pref') : null) || 'FR'
  )
  const { theme, setTheme } = useTheme()

  // Edit profile form
  const [editName, setEditName] = useState(user?.name || '')
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [editPhone, setEditPhone] = useState(user?.phone || '')

  // Change password form
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSaveProfile = async () => {
    if (!editName || !editEmail || !editPhone) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        useAppStore.getState().setUser(data.data)
        toast.success('Profil mis a jour avec succes !')
        setShowEditDialog(false)
      } else {
        toast.error(data.error || 'Erreur lors de la mise a jour')
      }
    } catch {
      toast.error('Erreur reseau')
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caracteres')
      return
    }
    try {
      const token = localStorage.getItem('mova_token')
      const res = await fetch('/api/mova/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Mot de passe modifie avec succes !')
        setShowPasswordDialog(false)
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || 'Erreur lors de la modification')
      }
    } catch {
      toast.error('Erreur reseau')
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Deconnexion reussie')
  }

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 mova-glass border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold">Mon Profil</h1>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-4 space-y-4 pb-24">
          {/* Profile Card */}
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="relative inline-block">
                <Avatar className="h-24 w-24 border-4 border-emerald-200 mx-auto">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold">{user?.name || 'Utilisateur'}</h2>
                <p className="text-sm text-muted-foreground mt-1">Membre MOVA</p>
              </div>
              <Dialog open={showEditDialog} onOpenChange={(open) => {
                setShowEditDialog(open)
                if (open && user) {
                  setEditName(user.name || '')
                  setEditEmail(user.email || '')
                  setEditPhone(user.phone || '')
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Modifier le profil
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier le profil</DialogTitle>
                    <DialogDescription>
                      Mettez a jour vos informations personnelles
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Nom complet</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Votre nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Votre email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+224 6xx xx xx xx"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                      Annuler
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveProfile}>
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* User Info */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Nom complet</p>
                  <p className="text-sm font-medium">{user?.name || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user?.email || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Telephone</p>
                  <p className="text-sm font-medium">{user?.phone || '-'}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Zone</p>
                  <p className="text-sm font-medium">{user?.zone || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="mova-card-hover">
              <CardContent className="p-4 text-center">
                <Car className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold">{user?.totalRides || 0}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </CardContent>
            </Card>
            <Card className="mova-card-hover">
              <CardContent className="p-4 text-center">
                <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold">{user?.rating || 0}</p>
                <p className="text-xs text-muted-foreground">Note</p>
              </CardContent>
            </Card>
            <Card className="mova-card-hover">
              <CardContent className="p-4 text-center">
                <Calendar className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}</p>
                <p className="text-xs text-muted-foreground">Inscription</p>
              </CardContent>
            </Card>
          </div>

          {/* Settings Toggles */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground">Recevoir les alertes et mises a jour</p>
                  </div>
                </div>
                <Switch checked={notifications} onCheckedChange={(checked) => {
                  setNotifications(checked)
                  if (typeof window !== 'undefined') localStorage.setItem('mova_notif_pref', String(checked))
                  toast.success(checked ? 'Notifications activees' : 'Notifications desactivees')
                }} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Langue</p>
                    <p className="text-xs text-muted-foreground">Langue de l'application</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-1"
                  onClick={() => {
                    const next = language === 'FR' ? 'EN' : 'FR'
                    setLanguage(next)
                    if (typeof window !== 'undefined') localStorage.setItem('mova_lang_pref', next)
                    toast.success(`Langue : ${next === 'FR' ? 'Francais' : 'English'}`)
                  }}>
                  <span className="text-sm font-medium text-emerald-600">{language}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Mode sombre</p>
                    <p className="text-xs text-muted-foreground">Reduire la luminosite</p>
                  </div>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={(checked) => {
                  setTheme(checked ? 'dark' : 'light')
                  toast.success(checked ? 'Mode sombre active' : 'Mode clair active')
                }} />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Securite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Changer le mot de passe</p>
                        <p className="text-xs text-muted-foreground">Modifier votre mot de passe</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Changer le mot de passe</DialogTitle>
                    <DialogDescription>
                      Entrez votre ancien mot de passe puis le nouveau
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Ancien mot de passe</Label>
                      <Input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Ancien mot de passe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nouveau mot de passe</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmer le mot de passe</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirmer le mot de passe"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                      Annuler
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleChangePassword}>
                      Modifier
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Settings Link */}
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-3"
            onClick={() => setView('settings')}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Parametres avances</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>

          {/* Logout */}
          <Button
            variant="outline"
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-auto py-3"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Se deconnecter
          </Button>
        </div>
      </ScrollArea>
    </div>
  )
}
