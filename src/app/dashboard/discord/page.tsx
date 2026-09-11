import { DiscordCallsView } from "@/components/dashboard/discord-calls-view";
import { listMyDiscordCalls } from "@/app/dashboard/discord/actions";

export default async function DiscordCallsPage() {
  const calls = await listMyDiscordCalls();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre as chamadas em grupo que você fez no Discord — data e se ela realmente aconteceu.
          Isso conta junto com as chamadas individuais no seu fechamento em Controle.
        </p>
      </div>

      <DiscordCallsView initialCalls={calls} />
    </div>
  );
}
