import tkinter as tk
root = tk.Tk()
root.title("test")
tk.Label(root, text="hello").pack()
root.after(2000, root.destroy)
root.mainloop()
print("MIN_OK")
