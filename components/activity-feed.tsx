type Activity = {
  id: string;
  action: string;
  message: string;
  clientVisible: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  task: { id: string; title: string } | null;
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return <section className="mb-8 rounded-xl border p-6">
    <div className="mb-5">
      <h2 className="text-2xl font-semibold">Aktivitás</h2>
      <p className="mt-1 text-sm text-gray-600">A projekt fontosabb változásai időrendben.</p>
    </div>
    {activities.length === 0 ? <p className="text-sm text-gray-500">Még nincs naplózott aktivitás.</p> : <div className="grid gap-3">
      {activities.map(activity => <article key={activity.id} className="rounded-lg border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm"><span className="font-medium">{activity.user?.name ?? "Rendszer"}</span> · {activity.message}</p>
            {activity.task && <p className="mt-1 text-xs text-gray-500">Feladat: {activity.task.title}</p>}
          </div>
          <time className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleString("hu-HU")}</time>
        </div>
        {activity.clientVisible && <span className="mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase text-gray-500">Ügyfélnek látható</span>}
      </article>)}
    </div>}
  </section>;
}
