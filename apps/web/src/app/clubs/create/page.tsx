'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@pitchzone/ui';

import { KitPreview } from '@/components/clubs/kit-preview';
import {
  createClub,
  getClubColorPalette,
  getKitTemplates,
  uploadClubCover,
  uploadClubLogo,
  type ClubColor,
  type KitTemplate,
} from '@/lib/api';

const COUNTRIES = [
  { code: 'RU', name: 'Россия' },
  { code: 'BY', name: 'Беларусь' },
  { code: 'KZ', name: 'Казахстан' },
  { code: 'UA', name: 'Украина' },
  { code: 'DE', name: 'Германия' },
  { code: 'GB', name: 'Великобритания' },
];

export default function CreateClubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [country, setCountry] = useState('Россия');
  const [countryCode, setCountryCode] = useState('RU');
  const [vkGroupUrl, setVkGroupUrl] = useState('');
  const [twitchUrl, setTwitchUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1a1a2e');
  const [secondaryColor, setSecondaryColor] = useState('#C6FF3D');
  const [accentColor, setAccentColor] = useState('#F5F5F5');
  const [kitTemplateId, setKitTemplateId] = useState('classic');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [palette, setPalette] = useState<ClubColor[]>([]);
  const [templates, setTemplates] = useState<KitTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getClubColorPalette().then(setPalette).catch(() => setPalette([]));
    getKitTemplates()
      .then((items) => {
        setTemplates(items);
        if (items[0]) setKitTemplateId(items[0].id);
      })
      .catch(() => setTemplates([]));
  }, []);

  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/clubs/create');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');

    try {
      const team = await createClub(session.accessToken, {
        name,
        tag: tag.toUpperCase(),
        country,
        countryCode,
        vkGroupUrl: vkGroupUrl || undefined,
        twitchUrl: twitchUrl || undefined,
        youtubeUrl: youtubeUrl || undefined,
        primaryColor,
        secondaryColor,
        accentColor: accentColor || undefined,
        kitTemplateId,
      });

      if (logoFile) {
        await uploadClubLogo(session.accessToken, team.id, logoFile);
      }
      if (coverFile) {
        await uploadClubCover(session.accessToken, team.id, coverFile);
      }

      router.push(`/teams/${team.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания клуба');
    } finally {
      setLoading(false);
    }
  }

  function ColorSwatches({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (hex: string) => void;
    label: string;
  }) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-2">
          {palette.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.label}
              onClick={() => onChange(color.hex)}
              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                value === color.hex ? 'border-accent ring-2 ring-accent/40' : 'border-border'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-accent">
          ← На главную
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">Создать клуб</h1>
        <p className="mt-2 text-muted-foreground">
          Настройте цвета, форму и обложку — клуб появится в турнирах и трансферах
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Основные данные</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Название клуба</Label>
              <Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Сокращение (тег)</Label>
              <Input
                id="tag"
                required
                maxLength={5}
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Страна</Label>
              <select
                id="country"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={countryCode}
                onChange={(e) => {
                  const selected = COUNTRIES.find((c) => c.code === e.target.value);
                  setCountryCode(e.target.value);
                  if (selected) setCountry(selected.name);
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vk">Группа VK</Label>
              <Input id="vk" type="url" placeholder="https://vk.com/..." value={vkGroupUrl} onChange={(e) => setVkGroupUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitch">Twitch</Label>
              <Input id="twitch" type="url" placeholder="https://twitch.tv/..." value={twitchUrl} onChange={(e) => setTwitchUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube">YouTube</Label>
              <Input id="youtube" type="url" placeholder="https://youtube.com/..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Цветовая схема и форма</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColorSwatches value={primaryColor} onChange={setPrimaryColor} label="Основной цвет" />
            <ColorSwatches value={secondaryColor} onChange={setSecondaryColor} label="Второй цвет" />
            <ColorSwatches value={accentColor} onChange={setAccentColor} label="Акцентный цвет (воротник, номер)" />

            <div className="space-y-2">
              <Label>Шаблон формы</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setKitTemplateId(template.id)}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                      kitTemplateId === template.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <KitPreview
                      templateId={template.id}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      accentColor={accentColor}
                      className="mb-2 h-20 w-full"
                    />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <KitPreview
                templateId={kitTemplateId}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                accentColor={accentColor}
                className="mx-auto h-40 w-52"
              />
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Так форма будет выглядеть в сборной тура и других клубных блоках
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Логотип и обложка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo">Логотип (PNG без прозрачности)</Label>
              <Input
                id="logo"
                type="file"
                accept="image/png"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover">Обложка (~1890×320, до 1 МБ)</Label>
              <Input
                id="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Сохранение...' : 'Сохранить клуб'}
        </Button>
      </form>
    </div>
  );
}
