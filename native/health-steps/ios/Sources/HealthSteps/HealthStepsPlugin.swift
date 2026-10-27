import Capacitor
import HealthKit

@objc(HealthStepsPlugin)
public class HealthStepsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthStepsPlugin"
    public let jsName = "HealthSteps"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private let askedKey = "resuming.healthStepsAsked"
    private let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount)

    @objc func availability(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable() && stepType != nil])
    }

    @objc func authorization(_ call: CAPPluginCall) {
        call.resolve(["asked": UserDefaults.standard.bool(forKey: askedKey)])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(), let stepType else {
            call.reject("Health data is not available")
            return
        }
        store.requestAuthorization(toShare: [], read: [stepType]) { [weak self] _, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            if let askedKey = self?.askedKey {
                UserDefaults.standard.set(true, forKey: askedKey)
            }
            call.resolve()
        }
    }

    @objc func query(_ call: CAPPluginCall) {
        guard let stepType,
              let start = parseDate(call.getString("start")),
              let end = parseDate(call.getString("end")) else {
            call.reject("Missing range")
            return
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let anchor = Calendar.current.startOfDay(for: start)
        let query = HKStatisticsCollectionQuery(
            quantityType: stepType,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum,
            anchorDate: anchor,
            intervalComponents: DateComponents(day: 1)
        )
        query.initialResultsHandler = { _, results, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            var days: [[String: Any]] = []
            results?.enumerateStatistics(from: anchor, to: end) { stats, _ in
                let raw = stats.sumQuantity()?.doubleValue(for: .count()) ?? 0
                let steps = max(0, Int(raw.rounded()))
                days.append(["date": Self.dayString(stats.startDate), "steps": steps])
            }
            call.resolve(["days": days])
        }
        store.execute(query)
    }

    private func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: value)
    }

    private static func dayString(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}
