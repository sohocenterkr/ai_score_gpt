import { Router } from "express";
import { getDatabase } from "../db";

function serializeNotice(notice: {
  id: string;
  title: string;
  content: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    startsAt: notice.startsAt?.toISOString() ?? null,
    endsAt: notice.endsAt?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  };
}

export function createNoticeRouter() {
  const router = Router();

  router.get("/active", async (_request, response) => {
    const prisma = getDatabase();
    const now = new Date();

    const notices = await prisma.noticePopup.findMany({
      where: {
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
    });

    response.json({
      notices: notices.map(serializeNotice),
    });
  });

  return router;
}
