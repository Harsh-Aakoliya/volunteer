package com.harsh123890.Sevak

import android.content.Context
import android.text.Editable
import android.text.Spannable
import android.text.TextWatcher
import android.text.style.StyleSpan
import android.text.style.UnderlineSpan
import android.util.AttributeSet
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.widget.AppCompatEditText

class FormatAwareEditText @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AppCompatEditText(context, attrs) {

    var onFormatRequested: (() -> Unit)? = null

    private val textWatcher = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) {
            if (!suppressOnChange) {
                onTextChangedCallback?.invoke(s?.toString() ?: "")
            }
        }
    }

    var onTextChangedCallback: ((String) -> Unit)? = null

    private var suppressOnChange = false

    fun setSuppressOnChange(suppress: Boolean) {
        suppressOnChange = suppress
    }

    init {
        addTextChangedListener(textWatcher)
        setCustomSelectionActionModeCallback(object : ActionMode.Callback {
            override fun onCreateActionMode(mode: ActionMode?, menu: Menu?): Boolean {
                // Add Format item once when action mode is created
                // Using order 100 to place it after system items (Cut/Copy/Paste)
                menu?.add(0, R.id.menu_format, 100, "Format")
                return true
            }

            override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?): Boolean {
                // Don't modify menu here to avoid duplicates
                return false
            }

            override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?): Boolean {
                if (item?.itemId == R.id.menu_format) {
                    onFormatRequested?.invoke()
                    mode?.finish()
                    return true
                }
                // Let system handle other items (Cut/Copy/Paste)
                return false
            }

            override fun onDestroyActionMode(mode: ActionMode?) {
                // Cleanup if needed
            }
        })
    }

    fun applyBold() {
        applyToSelection { StyleSpan(android.graphics.Typeface.BOLD) }
    }

    fun applyItalic() {
        applyToSelection { StyleSpan(android.graphics.Typeface.ITALIC) }
    }

    fun applyUnderline() {
        applyToSelection { UnderlineSpan() }
    }

    private fun applyToSelection(spanFactory: () -> Any) {
        val start = selectionStart
        val end = selectionEnd
        if (start < 0 || end < 0 || start == end) return
        val span = spanFactory()
        text?.let { editable ->
            if (editable is Spannable) {
                editable.setSpan(span, start, end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
    }
}
