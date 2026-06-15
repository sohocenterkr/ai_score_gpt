import { disconnectDatabase } from "../db";
import { runNextQueuedScan } from "./scan-worker";

try {
  const result = await runNextQueuedScan();

  if (!result) {
    console.log("대기 중인 검사 작업이 없습니다.");
  } else {
    console.log(
      JSON.stringify(
        {
          message: "검사 작업 실행 완료",
          ...result,
        },
        null,
        2,
      ),
    );

    if (result.status === "FAILED") {
      process.exitCode = 1;
    }
  }
} finally {
  await disconnectDatabase();
}
