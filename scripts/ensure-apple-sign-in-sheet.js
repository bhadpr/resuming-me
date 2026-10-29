import { readFileSync, writeFileSync } from 'node:fs'

const path = 'node_modules/@capacitor-community/apple-sign-in/ios/Sources/SignInWithApple/Plugin.swift'

let text
try {
  text = readFileSync(path, 'utf8')
} catch {
  process.exit(0)
}

if (text.includes('resuming-apple-anchor')) process.exit(0)

const fresh = `        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.performRequests()`

const previous = `        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()`

const next = `        // resuming-apple-anchor: the sheet must be presented on the main thread from a real window.
        DispatchQueue.main.async {
            let authorizationController = ASAuthorizationController(authorizationRequests: [request])
            self.currentAuthorizationController = authorizationController
            authorizationController.delegate = self
            authorizationController.presentationContextProvider = self
            authorizationController.performRequests()
        }`

if (text.includes(previous)) text = text.replace(previous, next)
else if (text.includes(fresh)) text = text.replace(fresh, next)
else {
  console.error('Apple sign-in plugin layout changed; the sheet anchor was not added.')
  process.exit(1)
}

if (!text.includes('currentAuthorizationController')) {
  text = text.replace(
    `        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]`,
    `        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]
    private var currentAuthorizationController: ASAuthorizationController?`,
  )
}

text = text.replace(
  'call.reject(error.localizedDescription)',
  'let nsError = error as NSError\n        call.reject("\\(error.localizedDescription) (\\(nsError.domain) \\(nsError.code))")\n        self.currentAuthorizationController = nil',
)
text = text.replace(
  'call.resolve(result)\n        self.bridge?.releaseCall(call)',
  'call.resolve(result)\n        self.currentAuthorizationController = nil\n        self.bridge?.releaseCall(call)',
)

const oldAnchor = `    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        self.bridge?.webView?.window ?? ASPresentationAnchor()
    }`

const newAnchor = `    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let sceneWindows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
        if let window = self.bridge?.webView?.window, sceneWindows.contains(window) {
            return window
        }
        if let key = sceneWindows.first(where: { $0.isKeyWindow }) {
            return key
        }
        if let any = sceneWindows.first {
            return any
        }
        return ASPresentationAnchor()
    }`

if (text.includes(oldAnchor)) {
  text = text.replace(oldAnchor, newAnchor)
} else if (!text.includes('ASAuthorizationControllerPresentationContextProviding')) {
  text += `
extension SignInWithApple: ASAuthorizationControllerPresentationContextProviding {
${newAnchor}
}
`
}

writeFileSync(path, text)
