import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-border/50 bg-card/50 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-bold">
              Pitch<span className="text-accent">Zone</span>
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Турнирная платформа нового поколения для киберфутбола
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Платформа</h4>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Турниры
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="hover:text-foreground">
                  Рейтинг
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Аккаунт</h4>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Вход
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-foreground">
                  Регистрация
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Соцсети</h4>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>Discord</li>
              <li>Telegram</li>
            </ul>
          </div>
        </div>
        <div className="border-border/50 text-muted-foreground mt-8 border-t pt-8 text-center text-xs">
          © 2026 PitchZone. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
