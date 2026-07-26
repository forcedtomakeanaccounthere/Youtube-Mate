"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"

export interface ReCaptchaRef {
  reset: () => void
  getValue: () => string | null
}

interface ReCaptchaProps {
  onChange: (token: string | null) => void
  theme?: "light" | "dark"
}

export const ReCaptcha = forwardRef<ReCaptchaRef, ReCaptchaProps>(
  ({ onChange, theme = "light" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<number | null>(null)
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

    useImperativeHandle(ref, () => ({
      reset: () => {
        const grecaptcha = (window as any).grecaptcha
        if (grecaptcha && widgetIdRef.current !== null) {
          try {
            grecaptcha.reset(widgetIdRef.current)
          } catch (e) {
            console.error("Error resetting reCAPTCHA widget:", e)
          }
          onChange(null)
        }
      },
      getValue: () => {
        const grecaptcha = (window as any).grecaptcha
        if (grecaptcha && widgetIdRef.current !== null) {
          try {
            return grecaptcha.getResponse(widgetIdRef.current)
          } catch (e) {
            console.error("Error getting reCAPTCHA response:", e)
          }
        }
        return null
      }
    }))

    useEffect(() => {
      if (!siteKey) {
        console.warn("reCAPTCHA site key is missing in environment variables.")
        return
      }

      const scriptId = "google-recaptcha-script"
      let script = document.getElementById(scriptId) as HTMLScriptElement

      const initializeRecaptcha = () => {
        const grecaptcha = (window as any).grecaptcha
        if (grecaptcha && containerRef.current && widgetIdRef.current === null) {
          grecaptcha.ready(() => {
            try {
              // Only render if container is empty
              if (containerRef.current && containerRef.current.innerHTML === "") {
                widgetIdRef.current = grecaptcha.render(containerRef.current, {
                  sitekey: siteKey,
                  callback: (token: string) => onChange(token),
                  "expired-callback": () => onChange(null),
                  "error-callback": () => onChange(null),
                  theme: theme,
                })
              }
            } catch (e) {
              console.error("Error rendering reCAPTCHA:", e)
            }
          })
        }
      }

      if (!script) {
        script = document.createElement("script")
        script.id = scriptId
        script.src = "https://www.google.com/recaptcha/api.js?render=explicit"
        script.async = true
        script.defer = true
        document.body.appendChild(script)
        script.onload = initializeRecaptcha
      } else {
        const grecaptcha = (window as any).grecaptcha
        if (grecaptcha && grecaptcha.render) {
          initializeRecaptcha()
        } else {
          script.addEventListener("load", initializeRecaptcha)
        }
      }

      return () => {
        if (script) {
          script.removeEventListener("load", initializeRecaptcha)
        }
        // When unmounting, we don't necessarily need to reset grecaptcha,
        // but setting widgetIdRef.current to null is safe.
        widgetIdRef.current = null
      }
    }, [siteKey, onChange, theme])

    if (!siteKey) {
      return (
        <div className="text-red-500 text-xs text-center font-medium my-2">
          reCAPTCHA Site Key not configured
        </div>
      )
    }

    return (
      <div 
        ref={containerRef} 
        className="flex justify-center my-3 min-h-[78px]" 
      />
    )
  }
)

ReCaptcha.displayName = "ReCaptcha"
