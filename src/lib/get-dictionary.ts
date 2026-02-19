import { cookies } from "next/headers"
import { dictionary, Locale } from "@/lib/dictionary"

export async function getDictionary() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value as Locale || "en"
  return dictionary[locale] || dictionary.en
}
