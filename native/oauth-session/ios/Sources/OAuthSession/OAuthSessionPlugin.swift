import Foundation
import Capacitor
import AuthenticationServices

@objc(OAuthSessionPlugin)
public class OAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "OAuthSessionPlugin"
    public let jsName = "OAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing url")
            return
        }
        let scheme = call.getString("callbackScheme") ?? "com.cheerfulgames.resuming"

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let error = error as NSError? {
                    let cancelled = error.domain == ASWebAuthenticationSessionError.errorDomain
                        && error.code == ASWebAuthenticationSessionError.canceledLogin.rawValue
                    call.reject(cancelled ? "cancel" : error.localizedDescription)
                    return
                }
                guard let callbackURL else {
                    call.reject("Sign-in did not return")
                    return
                }
                call.resolve(["url": callbackURL.absoluteString])
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("Could not open sign-in")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        self.bridge?.webView?.window ?? ASPresentationAnchor()
    }
}
