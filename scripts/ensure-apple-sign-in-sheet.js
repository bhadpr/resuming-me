import { readFileSync, writeFileSync } from 'node:fs'

const path = 'node_modules/@capacitor-community/apple-sign-in/ios/Sources/SignInWithApple/Plugin.swift'

let text
try {
  text = readFileSync(path, 'utf8')
} catch {
  process.exit(0)
}

if (text.includes('presentationContextProvider')) process.exit(0)

const needle = `        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.performRequests()`

const replacement = `        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()`

if (!text.includes(needle)) {
  console.error('Apple sign-in plugin layout changed; the sheet anchor was not added.')
  process.exit(1)
}

text = text.replace(needle, replacement)
text += `
extension SignInWithApple: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        self.bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
`

writeFileSync(path, text)
