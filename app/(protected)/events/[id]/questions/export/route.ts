import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent } from "@/modules/events";
import { getQuestionSession, listModeratorQuestions, buildQuestionsCsv, buildQuestionsPdf } from "@/modules/questions";
import { isActive } from "@/modules/users";
import { recordAudit } from "@/modules/audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event || !(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: id, capability: "questions" }))) {
    return new NextResponse(null, { status: 404 });
  }

  const session = await getQuestionSession(id, user.profile.organizationId);
  if (!session) return new NextResponse(null, { status: 404 });
  const rows = await listModeratorQuestions(session.id);
  const includeIdentity = request.url.includes("scope=internal");
  const exportRows = rows.map((row) => ({
    createdAt: row.createdAt,
    status: row.status,
    question: row.text,
    answer: row.answerText,
    votes: row.voteCount,
    topic: null,
    fullName: row.participantName,
    company: row.participantCompany,
  }));
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const filename = `preguntas-${event.slug}-${includeIdentity ? "interna" : "anonima"}.${format}`;
  await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "question_export", resourceType: "question_session", resourceId: session.id, after: { format, includeIdentity } });

  if (format === "pdf") {
    return new NextResponse(new Uint8Array(buildQuestionsPdf(exportRows, includeIdentity)), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  }
  return new NextResponse(buildQuestionsCsv(exportRows, includeIdentity), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
