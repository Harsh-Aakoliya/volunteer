package com.harsh123890.Sevak

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class FormatEditTextManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<FormatAwareEditText>() {

    override fun getName(): String = "FormatEditText"

    override fun createViewInstance(reactContext: ThemedReactContext): FormatAwareEditText {
        val editText = FormatAwareEditText(reactContext)
        editText.onFormatRequested = {
            this.reactContext
                .getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(editText.id, "onFormat", null)
        }
        editText.onTextChangedCallback = { text ->
            val event: WritableMap = Arguments.createMap()
            event.putString("text", text)
            this.reactContext
                .getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(editText.id, "onChangeText", event)
        }
        return editText
    }

    @ReactProp(name = "value")
    fun setValue(view: FormatAwareEditText, value: String?) {
        val current = view.text?.toString() ?: ""
        if (value != null && value != current) {
            view.setSuppressOnChange(true)
            view.setText(value)
            view.setSelection(value.length.coerceAtLeast(0))
            view.setSuppressOnChange(false)
        }
    }

    @ReactProp(name = "placeholder")
    fun setPlaceholder(view: FormatAwareEditText, placeholder: String?) {
        view.hint = placeholder
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return mapOf(
            "onFormat" to mapOf("registrationName" to "onFormat"),
            "onChangeText" to mapOf("registrationName" to "onChangeText")
        )
    }

    override fun receiveCommand(view: FormatAwareEditText, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "setBold" -> view.applyBold()
            "setItalic" -> view.applyItalic()
            "setUnderline" -> view.applyUnderline()
        }
    }
}
