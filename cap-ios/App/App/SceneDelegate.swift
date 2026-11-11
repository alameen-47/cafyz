import UIKit
import Capacitor

/// Scene-based startup. Recent iOS versions stop apps built with the current SDK
/// from launching without a scene delegate, so the window now belongs to the scene.
/// Main.storyboard (CAPBridgeViewController) is loaded through the scene manifest in
/// Info.plist, and links that reach the scene are handed to Capacitor exactly as
/// the app delegate used to hand them over.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard scene is UIWindowScene else { return }
        // A cold launch from a link arrives here rather than in the URL callbacks below.
        openURLs(connectionOptions.urlContexts)
        connectionOptions.userActivities.forEach(continueActivity)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        openURLs(URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    private func openURLs(_ contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
            if let source = context.options.sourceApplication { options[.sourceApplication] = source }
            if let annotation = context.options.annotation { options[.annotation] = annotation }
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    private func continueActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity) { _ in }
    }
}
