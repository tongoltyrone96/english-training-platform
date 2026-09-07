import { NextResponse } from "next/server";
import { getTrainingDestination } from "@/lib/start-training";

export async function POST(request: Request) {
  const destination = await getTrainingDestination();
  return NextResponse.redirect(new URL(destination, request.url), 303);
}
