"use client"

import { useEffect } from "react"

const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OGI3NDYyNGE1YjFiNThiMGJjNzU3ZCIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTc1Mzk3MDI4NSwiZXhwIjoxNzU0NTc1MDg1fQ.xyguFWFtLJAs6oKynK_ioZ_7NH1Ww6ee79oTn3Ki1po"

export default function DevAuthHelper() {
  useEffect(() => {
    // Only in development mode
    if (process.env.NODE_ENV === "development") {
      const existingToken = localStorage.getItem("token")
      if (!existingToken) {
        localStorage.setItem("token", TEST_TOKEN)
        console.log("🔐 Development auth token set automatically")
        console.log("Test user: test@example.com")
      }
    }
  }, [])

  return null // This component doesn't render anything
}
