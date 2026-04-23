export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      <p className="font-medium">Не удалось загрузить данные</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed opacity-95">
        {message}
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-red-800">
        <li>
          Запущен ли Postgres:{" "}
          <code className="rounded bg-red-100 px-1">docker compose up -d</code> в корне{" "}
          <code className="rounded bg-red-100 px-1">contentflow-saas</code>
        </li>
        <li>
          В папке <code className="rounded bg-red-100 px-1">api</code>:{" "}
          <code className="rounded bg-red-100 px-1">npx prisma migrate deploy</code>, затем{" "}
          <code className="rounded bg-red-100 px-1">npm run start:dev</code>
        </li>
        <li>
          В <code className="rounded bg-red-100 px-1">web/.env.local</code> должно быть{" "}
          <code className="rounded bg-red-100 px-1">API_URL=http://localhost:3000</code> (или
          127.0.0.1, если localhost не резолвится)
        </li>
      </ul>
    </div>
  );
}
