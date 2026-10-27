import Capacitor
import UIKit

@objc(AppSettingsPlugin)
public class AppSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSettingsPlugin"
    public let jsName = "AppSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Could not open Settings")
                return
            }
            UIApplication.shared.open(url) { opened in
                if opened {
                    call.resolve()
                } else {
                    call.reject("Could not open Settings")
                }
            }
        }
    }
}
