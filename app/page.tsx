// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/wardrobe"); // хочешь — поставь "/looks" или другую стартовую
}
