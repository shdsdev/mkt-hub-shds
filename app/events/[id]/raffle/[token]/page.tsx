import { notFound } from "next/navigation";
import { getRaffleStageState } from "@/modules/raffles";
import { StageScreen } from "./stage-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RaffleStagePage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const state = await getRaffleStageState(id, token);
  if (!state) notFound();
  return <StageScreen initialState={state} apiPath={`/api/events/${id}/raffle/${token}`} />;
}
