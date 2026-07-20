// app/fonts.ts
import localFont from "next/font/local";

export const bileha = localFont({
  src: [
    {
      path: "../../public/fonts/Bileha.otf",
      weight: "400",
      style: "normal",
    },
    // {
    //   path: "../../public/fonts/Bonsad-Regular.otf",
    //   weight: "400",
    //   style: "normal",
    // },
    // {
    //   path: "../../public/fonts/Slogest.otf",
    //   weight: "400",
    //   style: "normal",
    // },
    // {
    //   path: "../../public/fonts/Mestika.otf",
    //   weight: "400",
    //   style: "normal",
    // },
    // {
    //   path: "../../public/fonts/Crosever-8OOrM.ttf",
    //   weight: "400",
    //   style: "normal",
    // },
  ],
  variable: "--font-bileha",
});
export const slogest = localFont({
  src: [
    {
      path: "../../public/fonts/Slogest.otf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-slogest",
});
export const mestika = localFont({
  src: [
    {
      path: "../../public/fonts/Mestika.otf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-mestika",
});